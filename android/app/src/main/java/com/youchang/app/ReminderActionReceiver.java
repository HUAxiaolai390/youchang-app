package com.youchang.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.app.NotificationManagerCompat;

public class ReminderActionReceiver extends BroadcastReceiver {
    public static final String ACTION_COMPLETE = "com.youchang.app.REMINDER_COMPLETE";
    public static final String ACTION_SNOOZE = "com.youchang.app.REMINDER_SNOOZE";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String kind = intent.getStringExtra(ExactReminderReceiver.EXTRA_KIND);
        String taskId = intent.getStringExtra(ExactReminderReceiver.EXTRA_TASK_ID);
        String date = intent.getStringExtra(ExactReminderReceiver.EXTRA_DATE);
        int notificationId = intent.getIntExtra(ExactReminderReceiver.EXTRA_ID, 0);
        if ((!ACTION_COMPLETE.equals(action) && !ACTION_SNOOZE.equals(action))
            || kind == null || taskId == null || date == null || notificationId == 0) return;

        if (ACTION_COMPLETE.equals(action)) {
            ReminderActionStore.append(context, "complete", kind, taskId, date, System.currentTimeMillis());
        } else {
            long remindAt = System.currentTimeMillis() + 10 * 60_000L;
            String title = intent.getStringExtra(ExactReminderReceiver.EXTRA_TITLE);
            boolean wakeScreen = intent.getBooleanExtra(ExactReminderReceiver.EXTRA_WAKE_SCREEN, true);
            if (title == null) title = "有常 · 任务提醒";
            ExactReminderScheduler.schedule(
                context,
                notificationId,
                remindAt,
                title,
                "已推迟 10 分钟，现在可以继续行动了。",
                wakeScreen,
                kind,
                taskId,
                date
            );
            ReminderActionStore.append(context, "snooze", kind, taskId, date, remindAt);
        }
        NotificationManagerCompat.from(context).cancel(notificationId);
    }
}
