package com.youchang.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ExactReminderScheduler {
    private static final String PREFERENCES = "youchang_exact_reminders";
    private static final String SCHEDULES = "schedules";

    private ExactReminderScheduler() {}

    private static AlarmManager alarmManager(Context context) {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    private static PendingIntent reminderIntent(
        Context context,
        int id,
        String title,
        String body,
        String kind,
        String taskId,
        String date,
        int pendingFlags
    ) {
        Intent intent = new Intent(context, ExactReminderReceiver.class);
        intent.putExtra(ExactReminderReceiver.EXTRA_ID, id);
        intent.putExtra(ExactReminderReceiver.EXTRA_TITLE, title);
        intent.putExtra(ExactReminderReceiver.EXTRA_BODY, body);
        intent.putExtra(ExactReminderReceiver.EXTRA_KIND, kind);
        intent.putExtra(ExactReminderReceiver.EXTRA_TASK_ID, taskId);
        intent.putExtra(ExactReminderReceiver.EXTRA_DATE, date);
        return PendingIntent.getBroadcast(context, id, intent, pendingFlags | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void schedule(Context context, int id, long at, String title, String body) {
        schedule(context, id, at, title, body, "", "", "");
    }

    public static void schedule(
        Context context,
        int id,
        long at,
        String title,
        String body,
        String kind,
        String taskId,
        String date
    ) {
        if (at <= System.currentTimeMillis()) return;
        ExactReminderReceiver.ensureChannel(context);
        PendingIntent trigger = reminderIntent(context, id, title, body, kind, taskId, date, PendingIntent.FLAG_UPDATE_CURRENT);
        AlarmManager manager = alarmManager(context);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !manager.canScheduleExactAlarms()) {
            throw new SecurityException("Exact alarm permission denied");
        }
        Intent launchIntent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        PendingIntent showIntent = trigger;
        if (launchIntent != null) {
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            showIntent = PendingIntent.getActivity(
                context,
                id ^ 0x40000000,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }
        manager.setAlarmClock(new AlarmManager.AlarmClockInfo(at, showIntent), trigger);
    }

    public static void cancel(Context context, int id) {
        PendingIntent trigger = reminderIntent(context, id, "", "", "", "", "", PendingIntent.FLAG_NO_CREATE);
        if (trigger != null) {
            alarmManager(context).cancel(trigger);
            trigger.cancel();
        }
    }

    public static void persist(Context context, JSONArray reminders) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit().putString(SCHEDULES, reminders.toString()).apply();
    }

    public static void restore(Context context) {
        String stored = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(SCHEDULES, "[]");
        try {
            JSONArray reminders = new JSONArray(stored);
            for (int index = 0; index < reminders.length(); index++) {
                JSONObject item = reminders.getJSONObject(index);
                schedule(
                    context,
                    item.getInt("id"),
                    item.getLong("at"),
                    item.getString("title"),
                    item.getString("body"),
                    item.optString("kind", ""),
                    item.optString("taskId", ""),
                    item.optString("date", "")
                );
            }
        } catch (JSONException | SecurityException ignored) {
            // The app will synchronize again the next time it opens.
        }
    }
}
