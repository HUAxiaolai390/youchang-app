package com.youchang.app;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(name = "ExactReminder")
public class ExactReminderPlugin extends Plugin {
    @PluginMethod
    public void replace(PluginCall call) {
        JSArray oldIds = call.getArray("oldIds", new JSArray());
        JSArray reminders = call.getArray("reminders", new JSArray());
        try {
            for (int index = 0; index < oldIds.length(); index++) cancel(oldIds.getInt(index));
            for (int index = 0; index < reminders.length(); index++) {
                JSONObject object = reminders.getJSONObject(index);
                int id = object.getInt("id");
                long at = object.getLong("at");
                String title = object.getString("title");
                String body = object.getString("body");
                boolean wakeScreen = object.optBoolean("wakeScreen", true);
                schedule(id, at, title, body, wakeScreen);
            }
            ExactReminderScheduler.persist(getContext(), reminders);
            call.resolve();
        } catch (JSONException | SecurityException error) {
            call.reject("无法安排准时提醒", error);
        }
    }

    @PluginMethod
    public void scheduleTest(PluginCall call) {
        Object atValue = call.getData().opt("at");
        if (!(atValue instanceof Number)) {
            call.reject("缺少测试时间");
            return;
        }
        long at = ((Number) atValue).longValue();
        try {
            boolean wakeScreen = call.getBoolean("wakeScreen", true);
            schedule(2_100_000_002, at, "有常 · 定时测试成功", "即使没有打开有常，这条提醒也按时出现了。", wakeScreen);
            call.resolve(new JSObject().put("at", at));
        } catch (SecurityException error) {
            call.reject("请先允许准时提醒权限", error);
        }
    }

    private void schedule(int id, long at, String title, String body, boolean wakeScreen) {
        ExactReminderScheduler.schedule(getContext(), id, at, title, body, wakeScreen);
    }

    private void cancel(int id) {
        ExactReminderScheduler.cancel(getContext(), id);
    }
}
