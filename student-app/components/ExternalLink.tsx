import { Link } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform, Linking } from 'react-native';

export function ExternalLink(props: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  return (
    <Link
      target="_blank"
      {...props}
      href={props.href}
      onPress={(e) => {
        if (Platform.OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          e.preventDefault();
          // Open the link in the device browser.
          Linking.openURL(props.href as string);
        }
      }}
    />
  );
}
