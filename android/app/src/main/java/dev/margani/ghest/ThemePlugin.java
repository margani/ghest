package dev.margani.ghest;

import android.content.Context;
import android.content.res.Configuration;
import android.content.res.Resources;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Applies the in-app theme (System / Light / Dark) to the Android side. On WebViews
 * older than 140, Capacitor draws the status and navigation bars over the window
 * background, which follows the night mode, so without this a Light choice on a
 * phone in dark mode left dark bars around a light page (seen on WebView 124).
 *
 * It also reports the device's own dark mode: once the app has started in a forced theme,
 * the WebView's prefers-color-scheme keeps that start-up value, so going back to System
 * picked the wrong theme.
 */
@CapacitorPlugin(name = "Theme")
public class ThemePlugin extends Plugin {

    private static final String PREFS = "ghest-native";
    private static final String KEY = "theme";

    /** Night mode for a stored theme; read in MainActivity before the first frame. */
    static int nightMode(Context context) {
        return toNightMode(context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "system"));
    }

    private static int toNightMode(String theme) {
        switch (theme) {
            case "light":
                return AppCompatDelegate.MODE_NIGHT_NO;
            case "dark":
                return AppCompatDelegate.MODE_NIGHT_YES;
            default:
                return AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM;
        }
    }

    /** The device setting, not the activity's: AppCompat rewrites the activity's uiMode. */
    private static JSObject systemTheme() {
        int night = Resources.getSystem().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        JSObject result = new JSObject();
        result.put("dark", night == Configuration.UI_MODE_NIGHT_YES);
        return result;
    }

    @PluginMethod
    public void set(PluginCall call) {
        String theme = call.getString("theme", "system");
        getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, theme).apply();
        getActivity().runOnUiThread(() -> {
            AppCompatDelegate.setDefaultNightMode(toNightMode(theme));
            call.resolve(systemTheme());
        });
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        notifyListeners("systemTheme", systemTheme());
    }
}
