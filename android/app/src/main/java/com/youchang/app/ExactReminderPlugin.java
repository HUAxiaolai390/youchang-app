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
    private static final int FOCUS_REMINDER_ID = 2_100_000_100;

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
                String kind = object.getString("kind");
                String taskId = object.getString("taskId");
                String date = object.getString("date");
                schedule(id, at, title, body, wakeScreen, kind, taskId, date);
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
            ExactReminderScheduler.schedule(getContext(), 2_100_000_002, at, "有常 · 定时测试成功", "即使没有打开有常，这条提醒也按时出现了。", wakeScreen);
            call.resolve(new JSObject().put("at", at));
        } catch (SecurityException error) {
            call.reject("请先允许准时提醒权限", error);
        }
    }

    @PluginMethod
    public void scheduleFocus(PluginCall call) {
        Object atValue = call.getData().opt("at");
        String title = call.getString("title");
        String body = call.getString("body");
        if (!(atValue instanceof Number) || title == null || body == null) {
            call.reject("缺少专注提醒信息");
            return;
        }
        long at = ((Number) atValue).longValue();
        boolean wakeScreen = call.getBoolean("wakeScreen", true);
        try {
            ExactReminderScheduler.cancel(getContext(), FOCUS_REMINDER_ID);
            ExactReminderScheduler.schedule(getContext(), FOCUS_REMINDER_ID, at, title, body, wakeScreen);
            ExactReminderScheduler.persistFocus(getContext(), at, title, body, wakeScreen);
            call.resolve(new JSObject().put("at", at));
        } catch (SecurityException error) {
            call.reject("请先允许通知权限", error);
        }
    }

    @PluginMethod
    public void cancelFocus(PluginCall call) {
        ExactReminderScheduler.cancel(getContext(), FOCUS_REMINDER_ID);
        ExactReminderScheduler.clearFocus(getContext());
        call.resolve();
    }

    @PluginMethod
    public void getActions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("actions", ReminderActionStore.pending(getContext()));
        call.resolve(result);
    }

    @PluginMethod
    public void acknowledgeActions(PluginCall call) {
        ReminderActionStore.acknowledge(getContext(), call.getArray("ids", new JSArray()));
        call.resolve();
    }

    @PluginMethod
    public void consumeActions(PluginCall call) {
        JSObject result = new JSObject();
        result.put("actions", ReminderActionStore.consume(getContext()));
        call.resolve(result);
    }

    private void schedule(int id, long at, String title, String body, boolean wakeScreen, String kind, String taskId, String date) {
        ExactReminderScheduler.schedule(getContext(), id, at, title, body, wakeScreen, kind, taskId, date);
    }

    private void cancel(int id) {
        ExactReminderScheduler.cancel(getContext(), id);
    }
}
