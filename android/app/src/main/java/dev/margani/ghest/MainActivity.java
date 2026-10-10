package dev.margani.ghest;

import android.content.Context;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatDelegate;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void attachBaseContext(Context base) {
        // AppCompat reads the night mode while attaching the base context; set it any later
        // (onCreate) and a saved Light/Dark choice started with the device's bar colours.
        AppCompatDelegate.setDefaultNightMode(ThemePlugin.nightMode(base));
        super.attachBaseContext(base);
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ThemePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
