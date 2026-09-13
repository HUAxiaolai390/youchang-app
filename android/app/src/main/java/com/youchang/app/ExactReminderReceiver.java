package com.youchang.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class ExactReminderReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "youchang-exact-reminders-v2";
    public static final String EXTRA_ID = "notificationId";
    public static final String EXTRA_TITLE = "notificationTitle";
    public static final String EXTRA_BODY = "notificationBody";
    public static final String EXTRA_WAKE_SCREEN = "wakeScreen";
    public static final String EXTRA_KIND = "taskKind";
    public static final String EXTRA_TASK_ID = "taskId";
    public static final String EXTRA_DATE = "taskDate";
    private static final String MASCOT_PREFERENCES = "youchang_notification_mascots";
    private static final String MASCOT_ORDER = "task_mascot_order_v2";
    private static final String MASCOT_CURSOR = "task_mascot_cursor_v2";
    private static final String MASCOT_LAST = "task_mascot_last_v2";
    private static final int[] TASK_MASCOTS = {
        R.drawable.notification_cat_idle_02,
        R.drawable.notification_cat_idle_03,
        R.drawable.notification_cat_idle_04,
        R.drawable.notification_cat_idle_05,
        R.drawable.notification_cat_idle_06,
        R.drawable.notification_cat_idle_08,
        R.drawable.notification_cat_idle_09,
        R.drawable.notification_cat_idle_10,
        R.drawable.notification_cat_idle_11,
        R.drawable.notification_cat_idle_12,
        R.drawable.notification_cat_idle_13,
        R.drawable.notification_cat_idle_14,
        R.drawable.notification_cat_idle_15,
        R.drawable.notification_cat_idle_16,
        R.drawable.notification_cat_idle_17,
        R.drawable.notification_cat_idle_18,
        R.drawable.notification_cat_idle_19,
        R.drawable.notification_cat_idle_20,
        R.drawable.notification_cat_sleep,
        R.drawable.notification_cat_celebrate,
        R.drawable.notification_cat_react
    };

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "有常通知提醒", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("任务、专注完成和休息结束提醒");
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(185, 130, 67));
        manager.createNotificationChannel(channel);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        int id = intent.getIntExtra(EXTRA_ID, 0);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        boolean wakeScreen = intent.getBooleanExtra(EXTRA_WAKE_SCREEN, true);
        String kind = intent.getStringExtra(EXTRA_KIND);
        String taskId = intent.getStringExtra(EXTRA_TASK_ID);
        String date = intent.getStringExtra(EXTRA_DATE);
        if (id == 0 || title == null || body == null) return;

        if (("fixed".equals(kind) || "scheduled".equals(kind)) && taskId != null && date != null) {
            ExactReminderScheduler.removePersistedReminder(context, id);
        }

        ensureChannel(context);
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) return;
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openApp = PendingIntent.getActivity(context, id, launchIntent, flags);

        PendingIntent completeAction = null;
        PendingIntent snoozeAction = null;
        PendingIntent secondaryAction = null;
        if (("fixed".equals(kind) || "scheduled".equals(kind)) && taskId != null && date != null) {
            completeAction = actionIntent(context, ReminderActionReceiver.ACTION_COMPLETE, id, title, wakeScreen, kind, taskId, date, id ^ 0x20000000);
            snoozeAction = actionIntent(context, ReminderActionReceiver.ACTION_SNOOZE, id, title, wakeScreen, kind, taskId, date, id ^ 0x30000000);
            secondaryAction = actionIntent(
                context,
                "scheduled".equals(kind) ? ReminderActionReceiver.ACTION_POSTPONE : ReminderActionReceiver.ACTION_SKIP,
                id,
                title,
                wakeScreen,
                kind,
                taskId,
                date,
                id ^ 0x50000000
            );
        }

        NotificationCompat.Builder notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_youchang)
            .setColor(Color.rgb(185, 130, 67))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body).setSummaryText("有常提醒"))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setAutoCancel(true)
            .setContentIntent(openApp);
        Bitmap mascot = BitmapFactory.decodeResource(context.getResources(), mascotResource(context, title));
        if (mascot != null) {
            notification.setLargeIcon(NotificationCompat.reduceLargeIconSize(context, mascot));
        }
        if (completeAction != null && snoozeAction != null && secondaryAction != null) {
            notification
                .addAction(0, "完成", completeAction)
                .addAction(0, "10 分钟后", snoozeAction)
                .addAction(0, "scheduled".equals(kind) ? "改到明天" : "跳过今天", secondaryAction);
        }

        try {
            NotificationManagerCompat.from(context).notify(id, notification.build());
            if (wakeScreen) wakeScreenBriefly(context);
        } catch (SecurityException ignored) {
            // Notification permission can be revoked after the alarm is scheduled.
        }
    }

    private int mascotResource(Context context, String title) {
        if (title.contains("专注完成")) return R.drawable.notification_cat_sleep;
        if (title.contains("休息结束")) return R.drawable.notification_cat_celebrate;
        return nextTaskMascot(context);
    }

    private int nextTaskMascot(Context context) {
        SharedPreferences preferences = context.getSharedPreferences(MASCOT_PREFERENCES, Context.MODE_PRIVATE);
        int[] order = parseMascotOrder(preferences.getString(MASCOT_ORDER, ""));
        int cursor = preferences.getInt(MASCOT_CURSOR, 0);
        int last = preferences.getInt(MASCOT_LAST, -1);
        if (order == null || cursor < 0 || cursor >= order.length) {
            order = shuffledMascotOrder(last);
            cursor = 0;
        }

        int selected = order[cursor];
        preferences.edit()
            .putString(MASCOT_ORDER, serializeMascotOrder(order))
            .putInt(MASCOT_CURSOR, cursor + 1)
            .putInt(MASCOT_LAST, selected)
            .apply();
        return TASK_MASCOTS[selected];
    }

    private int[] shuffledMascotOrder(int last) {
        List<Integer> shuffled = new ArrayList<>();
        for (int index = 0; index < TASK_MASCOTS.length; index++) shuffled.add(index);
        Collections.shuffle(shuffled);
        if (shuffled.size() > 1 && shuffled.get(0) == last) {
            Collections.swap(shuffled, 0, 1);
        }
        int[] order = new int[shuffled.size()];
        for (int index = 0; index < shuffled.size(); index++) order[index] = shuffled.get(index);
        return order;
    }

    private int[] parseMascotOrder(String value) {
        String[] parts = value.split(",");
        if (parts.length != TASK_MASCOTS.length) return null;
        int[] order = new int[parts.length];
        Set<Integer> seen = new HashSet<>();
        try {
            for (int index = 0; index < parts.length; index++) {
                order[index] = Integer.parseInt(parts[index]);
                if (order[index] < 0 || order[index] >= TASK_MASCOTS.length || !seen.add(order[index])) return null;
            }
            return order;
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String serializeMascotOrder(int[] order) {
        StringBuilder value = new StringBuilder();
        for (int index = 0; index < order.length; index++) {
            if (index > 0) value.append(',');
            value.append(order[index]);
        }
        return value.toString();
    }

    private PendingIntent actionIntent(
        Context context,
        String action,
        int notificationId,
        String title,
        boolean wakeScreen,
        String kind,
        String taskId,
        String date,
        int requestCode
    ) {
        Intent intent = new Intent(context, ReminderActionReceiver.class);
        intent.setAction(action);
        intent.putExtra(EXTRA_ID, notificationId);
        intent.putExtra(EXTRA_TITLE, title);
        intent.putExtra(EXTRA_WAKE_SCREEN, wakeScreen);
        intent.putExtra(EXTRA_KIND, kind);
        intent.putExtra(EXTRA_TASK_ID, taskId);
        intent.putExtra(EXTRA_DATE, date);
        return PendingIntent.getBroadcast(
            context,
            requestCode,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    @SuppressWarnings("deprecation")
    private void wakeScreenBriefly(Context context) {
        PowerManager manager = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
        if (manager == null || manager.isInteractive()) return;
        PowerManager.WakeLock wakeLock = manager.newWakeLock(
            PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                | PowerManager.ACQUIRE_CAUSES_WAKEUP
                | PowerManager.ON_AFTER_RELEASE,
            "有常:任务提醒亮屏"
        );
        wakeLock.acquire(5_000L);
    }

}
