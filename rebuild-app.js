const fs = require('fs');
const path = require('path');

const studentAppDir = path.join(__dirname, 'student-app');
const appDir = path.join(studentAppDir, 'app');

// Helpers for recursive directory deletion
function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.readdirSync(dirPath).forEach((file) => {
      const curPath = path.join(dirPath, file);
      if (fs.lstatSync(curPath).isDirectory()) {
        deleteFolderRecursive(curPath);
      } else {
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(dirPath);
    console.log(`Deleted directory: ${dirPath}`);
  }
}

function safeDeleteFile(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`Deleted file: ${filePath}`);
  }
}

// 1. Delete unnecessary files and folders
const pathsToDelete = [
  path.join(appDir, '(auth)'),
  path.join(appDir, '(tabs)', 'events.tsx'),
  path.join(appDir, '(tabs)', 'handbook.tsx'),
  path.join(appDir, '(tabs)', 'news.tsx'),
  path.join(appDir, '(tabs)', 'two.tsx'),
  path.join(appDir, 'modal.tsx')
];

pathsToDelete.forEach((p) => {
  if (fs.existsSync(p)) {
    if (fs.lstatSync(p).isDirectory()) {
      deleteFolderRecursive(p);
    } else {
      safeDeleteFile(p);
    }
  }
});

// 2. Define target files content
const filesToWrite = {
  // app/_layout.tsx
  [path.join(appDir, '_layout.tsx')]: `import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}
`,

  // app/index.tsx
  [path.join(appDir, 'index.tsx')]: `import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)" />;
}
`,

  // app/(tabs)/_layout.tsx
  [path.join(appDir, '(tabs)', '_layout.tsx')]: `import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { COLORS } from '../../constants/theme';

function TabIcon({ label, icon, focused }: { label: string; icon: string; focused: boolean }) {
  return (
    <View style={{ alignItems: 'center', paddingTop: 6 }}>
      <Text style={{ fontSize: focused ? 22 : 20 }}>{icon}</Text>
      <Text style={{ fontSize: 10, color: focused ? COLORS.primary : COLORS.textMuted, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 0,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="首页" icon="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="通知" icon="📢" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="工具" icon="🛠️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon label="我的" icon="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
`,

  // app/(tabs)/index.tsx
  [path.join(appDir, '(tabs)', 'index.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>首页</Text>
      <Text style={styles.subtitle}>内容建设中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
`,

  // app/(tabs)/notifications.tsx
  [path.join(appDir, '(tabs)', 'notifications.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function NotificationsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>通知</Text>
      <Text style={styles.subtitle}>暂无新通知</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
`,

  // app/(tabs)/tools.tsx
  [path.join(appDir, '(tabs)', 'tools.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function ToolsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>工具</Text>
      <Text style={styles.subtitle}>工具箱正在研发中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
`,

  // app/(tabs)/profile.tsx
  [path.join(appDir, '(tabs)', 'profile.tsx')]: `import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>我的</Text>
      <Text style={styles.subtitle}>个人中心建设中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});
`
};

// 3. Write files
Object.entries(filesToWrite).forEach(([filePath, content]) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Successfully wrote file: ${filePath}`);
});

console.log('App rebuild script completed successfully!');
