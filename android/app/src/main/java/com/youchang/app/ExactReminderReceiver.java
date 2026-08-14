package com.youchang.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Notification;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.PowerManager;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class ExactReminderReceiver extends BroadcastReceiver {
    public static final String CHANNEL_ID = "youchang-exact-reminders-v2";
    public static final String EXTRA_ID = "notificationId";
    public static final String EXTRA_TITLE = "notificationTitle";
    public static final String EXTRA_BODY = "notificationBody";
    public static final String EXTRA_WAKE_SCREEN = "wakeScreen";
    public static final String EXTRA_KIND = "taskKind";
    public static final String EXTRA_TASK_ID = "taskId";
    public static final String EXTRA_DATE = "taskDate";

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

        ensureChannel(context);
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (launchIntent == null) return;
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        PendingIntent openApp = PendingIntent.getActivity(context, id, launchIntent, flags);

        PendingIntent completeAction = null;
        PendingIntent snoozeAction = null;
        if (("fixed".equals(kind) || "scheduled".equals(kind)) && taskId != null && date != null) {
            completeAction = actionIntent(context, ReminderActionReceiver.ACTION_COMPLETE, id, title, wakeScreen, kind, taskId, date, id ^ 0x20000000);
            snoozeAction = actionIntent(context, ReminderActionReceiver.ACTION_SNOOZE, id, title, wakeScreen, kind, taskId, date, id ^ 0x30000000);
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
        if (completeAction != null && snoozeAction != null) {
            notification
                .addAction(0, "完成", completeAction)
                .addAction(0, "10 分钟后", snoozeAction);
        }

        try {
            NotificationManagerCompat.from(context).notify(id, notification.build());
            if (wakeScreen) wakeScreenBriefly(context);
        } catch (SecurityException ignored) {
            // Notification permission can be revoked after the alarm is scheduled.
        }
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
