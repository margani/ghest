package dev.margani.ghest;

import android.content.Context;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
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

        // Without the @capacitor/app plugin nothing handles Back, so Android closed the app
        // even with the editor open (#43). nav.js knows which pages are open; WebView.canGoBack()
        // is no help, as Chromium skips history entries added without a user gesture.
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge() == null ? null : getBridge().getWebView();
                if (webView == null) {
                    leave();
                    return;
                }
                webView.evaluateJavascript("window.ghestBack ? ghestBack() : false", result -> {
                    if (!"true".equals(result)) leave();
                });
            }

            /** Default Back: on the home screen, leave the app. */
            private void leave() {
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        });
    }
}
