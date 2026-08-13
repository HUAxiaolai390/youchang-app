package com.youchang.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public final class ReminderActionStore {
    private static final String PREFERENCES = "youchang_reminder_actions";
    private static final String ACTIONS = "actions";

    private ReminderActionStore() {}

    public static synchronized void append(
        Context context,
        String action,
        String kind,
        String taskId,
        String date,
        long at
    ) {
        JSONArray actions = read(context);
        JSONObject item = new JSONObject();
        try {
            item.put("action", action);
            item.put("kind", kind);
            item.put("taskId", taskId);
            item.put("date", date);
            item.put("at", at);
            actions.put(item);
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit().putString(ACTIONS, actions.toString()).apply();
        } catch (JSONException ignored) {
            // All written values are primitive, so this is only a defensive guard.
        }
    }

    public static synchronized JSONArray consume(Context context) {
        JSONArray actions = read(context);
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit().remove(ACTIONS).apply();
        return actions;
    }

    private static JSONArray read(Context context) {
        String stored = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(ACTIONS, "[]");
        try {
            return new JSONArray(stored);
        } catch (JSONException ignored) {
            return new JSONArray();
        }
    }
}
