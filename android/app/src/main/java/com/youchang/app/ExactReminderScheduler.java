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
    private static final String FOCUS_SCHEDULE = "focus_schedule";
    private static final int FOCUS_REMINDER_ID = 2_100_000_100;

    private ExactReminderScheduler() {}

    private static AlarmManager alarmManager(Context context) {
        return (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
    }

    private static PendingIntent reminderIntent(
        Context context,
        int id,
        String title,
        String body,
        boolean wakeScreen,
        String kind,
        String taskId,
        String date,
        int pendingFlags
    ) {
        Intent intent = new Intent(context, ExactReminderReceiver.class);
        intent.putExtra(ExactReminderReceiver.EXTRA_ID, id);
        intent.putExtra(ExactReminderReceiver.EXTRA_TITLE, title);
        intent.putExtra(ExactReminderReceiver.EXTRA_BODY, body);
        intent.putExtra(ExactReminderReceiver.EXTRA_WAKE_SCREEN, wakeScreen);
        intent.putExtra(ExactReminderReceiver.EXTRA_KIND, kind);
        intent.putExtra(ExactReminderReceiver.EXTRA_TASK_ID, taskId);
        intent.putExtra(ExactReminderReceiver.EXTRA_DATE, date);
        return PendingIntent.getBroadcast(context, id, intent, pendingFlags | PendingIntent.FLAG_IMMUTABLE);
    }

    public static void schedule(Context context, int id, long at, String title, String body, boolean wakeScreen) {
        schedule(context, id, at, title, body, wakeScreen, "", "", "");
    }

    public static void schedule(
        Context context,
        int id,
        long at,
        String title,
        String body,
        boolean wakeScreen,
        String kind,
        String taskId,
        String date
    ) {
        if (at <= System.currentTimeMillis()) return;
        ExactReminderReceiver.ensureChannel(context);
        PendingIntent trigger = reminderIntent(context, id, title, body, wakeScreen, kind, taskId, date, PendingIntent.FLAG_UPDATE_CURRENT);
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
        PendingIntent trigger = reminderIntent(context, id, "", "", false, "", "", "", PendingIntent.FLAG_NO_CREATE);
        if (trigger != null) {
            alarmManager(context).cancel(trigger);
            trigger.cancel();
        }
    }

    public static void persist(Context context, JSONArray reminders) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit().putString(SCHEDULES, reminders.toString()).apply();
    }

    public static void upsertPersistedReminder(
        Context context,
        int id,
        long at,
        String title,
        String body,
        boolean wakeScreen,
        String kind,
        String taskId,
        String date
    ) {
        try {
            JSONArray current = readPersistedReminders(context);
            JSONArray updated = new JSONArray();
            for (int index = 0; index < current.length(); index++) {
                JSONObject item = current.optJSONObject(index);
                if (item != null && item.optInt("id") != id) updated.put(item);
            }
            JSONObject reminder = new JSONObject();
            reminder.put("id", id);
            reminder.put("at", at);
            reminder.put("title", title);
            reminder.put("body", body);
            reminder.put("wakeScreen", wakeScreen);
            reminder.put("kind", kind);
            reminder.put("taskId", taskId);
            reminder.put("date", date);
            updated.put(reminder);
            persist(context, updated);
        } catch (JSONException ignored) {
            // These values are generated locally and should always serialize.
        }
    }

    public static void removePersistedReminder(Context context, int id) {
        JSONArray current = readPersistedReminders(context);
        JSONArray updated = new JSONArray();
        for (int index = 0; index < current.length(); index++) {
            JSONObject item = current.optJSONObject(index);
            if (item != null && item.optInt("id") != id) updated.put(item);
        }
        persist(context, updated);
    }

    private static JSONArray readPersistedReminders(Context context) {
        String stored = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(SCHEDULES, "[]");
        try {
            return new JSONArray(stored);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }

    public static void persistFocus(Context context, long at, String title, String body, boolean wakeScreen) {
        try {
            JSONObject reminder = new JSONObject();
            reminder.put("at", at);
            reminder.put("title", title);
            reminder.put("body", body);
            reminder.put("wakeScreen", wakeScreen);
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit().putString(FOCUS_SCHEDULE, reminder.toString()).apply();
        } catch (JSONException ignored) {
            // These values are generated locally and should always serialize.
        }
    }

    public static void clearFocus(Context context) {
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit().remove(FOCUS_SCHEDULE).apply();
    }

    public static void restore(Context context) {
        try {
            JSONArray reminders = readPersistedReminders(context);
            for (int index = 0; index < reminders.length(); index++) {
                JSONObject item = reminders.getJSONObject(index);
                schedule(
                    context,
                    item.getInt("id"),
                    item.getLong("at"),
                    item.getString("title"),
                    item.getString("body"),
                    item.optBoolean("wakeScreen", true),
                    item.optString("kind", ""),
                    item.optString("taskId", ""),
                    item.optString("date", "")
                );
            }
        } catch (JSONException | SecurityException ignored) {
            // The app will synchronize again the next time it opens.
        }
        String focusStored = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).getString(FOCUS_SCHEDULE, "");
        if (focusStored.isEmpty()) return;
        try {
            JSONObject focus = new JSONObject(focusStored);
            long focusAt = focus.getLong("at");
            if (focusAt <= System.currentTimeMillis()) {
                clearFocus(context);
                return;
            }
            schedule(
                context,
                FOCUS_REMINDER_ID,
                focusAt,
                focus.getString("title"),
                focus.getString("body"),
                focus.optBoolean("wakeScreen", true)
            );
        } catch (JSONException | SecurityException ignored) {
            clearFocus(context);
        }
    }
}
