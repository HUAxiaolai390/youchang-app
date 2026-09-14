package com.youchang.app;

import android.content.Context;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
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
            item.put("id", UUID.randomUUID().toString());
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

    public static synchronized JSONArray pending(Context context) {
        JSONArray actions = read(context);
        boolean migrated = false;
        for (int index = 0; index < actions.length(); index++) {
            JSONObject item = actions.optJSONObject(index);
            if (item == null || !item.optString("id").isEmpty()) continue;
            try {
                item.put("id", UUID.randomUUID().toString());
                migrated = true;
            } catch (JSONException ignored) {
                // UUID strings are always valid JSON values.
            }
        }
        if (migrated) {
            context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
                .edit().putString(ACTIONS, actions.toString()).apply();
        }
        return actions;
    }

    public static synchronized void acknowledge(Context context, JSONArray ids) {
        Set<String> acknowledged = new HashSet<>();
        for (int index = 0; index < ids.length(); index++) {
            String id = ids.optString(index, "");
            if (!id.isEmpty()) acknowledged.add(id);
        }
        if (acknowledged.isEmpty()) return;
        JSONArray current = read(context);
        JSONArray remaining = new JSONArray();
        for (int index = 0; index < current.length(); index++) {
            JSONObject item = current.optJSONObject(index);
            if (item == null || !acknowledged.contains(item.optString("id"))) {
                remaining.put(current.opt(index));
            }
        }
        context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .edit().putString(ACTIONS, remaining.toString()).apply();
    }

    // Retained for an older WebView bundle during an app upgrade.
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
