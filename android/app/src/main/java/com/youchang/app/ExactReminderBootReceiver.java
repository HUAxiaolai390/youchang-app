package com.youchang.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class ExactReminderBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        ExactReminderScheduler.restore(context);
    }
}
