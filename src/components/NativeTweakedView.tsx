import React from 'react';
import { requireNativeComponent, ViewProps, Platform, View, Text, StyleSheet } from 'react-native';

export interface CustomPanelProps extends ViewProps {
  statusText?: string;
}

// Bridge the native view, or provide a premium fallback if the native modules are not bundled/built yet
let CustomPanel: React.ComponentType<CustomPanelProps>;

try {
  CustomPanel = requireNativeComponent<CustomPanelProps>('CustomPanel');
} catch (error) {
  // Graceful fallback for mock or simulation environments
  CustomPanel = ({ statusText, style, ...props }: CustomPanelProps) => (
    <View style={[styles.fallbackContainer, style]} {...props}>
      <Text style={styles.fallbackTitle}>
        {Platform.select({
          android: 'Native Android View Panel (Simulation)',
          ios: 'Native iOS UIView Panel (Simulation)',
          default: 'Native View Panel (Simulation)',
        })}
      </Text>
      <Text style={styles.fallbackStatus}>
        {statusText || 'Engine State: Idle'}
      </Text>
    </View>
  );
}

export const NativeTweakedView: React.FC<CustomPanelProps> = ({ statusText, style, ...props }) => {
  return (
    <CustomPanel
      statusText={statusText}
      style={[styles.defaultStyle, style]}
      {...props}
    />
  );
};

const styles = StyleSheet.create({
  defaultStyle: {
    width: '100%',
    height: 150,
  },
  fallbackContainer: {
    width: '100%',
    height: 150,
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#374151',
  },
  fallbackTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackStatus: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
