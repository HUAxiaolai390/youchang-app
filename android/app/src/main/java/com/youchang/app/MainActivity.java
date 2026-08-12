package com.youchang.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(ExactReminderPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
