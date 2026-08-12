import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.youchang.app",
  appName: "有常",
  webDir: "dist",
  android: {
    backgroundColor: "#f4f0e8",
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_youchang",
      iconColor: "#B98243"
    }
  }
};

export default config;
