import React, { useRef, useState } from 'react';
import { View, Image, PanResponder, StyleSheet } from 'react-native';

interface LutCustomizerPadProps {
  colorOffset: number; // -100 to 100
  toneOffset: number;  // -100 to 100
  onValuesChange: (colorOffset: number, toneOffset: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export const LutCustomizerPad: React.FC<LutCustomizerPadProps> = ({
  colorOffset,
  toneOffset,
  onValuesChange,
  onDragStart,
  onDragEnd,
}) => {
  const containerRef = useRef<View>(null);
  const [padLayout, setPadLayout] = useState({ width: 0, height: 0 });

  // Map values (-100 to 100) to percentage coordinate (0 to 1)
  const xPercent = (colorOffset + 100) / 200;
  const yPercent = 1 - (toneOffset + 100) / 200; // Invert Y because top is 100 tone and bottom is -100 tone

  const handleTouch = (pageX: number, pageY: number) => {
    if (containerRef.current) {
      containerRef.current.measure((x, y, width, height, px, py) => {
        let touchX = pageX - px;
        let touchY = pageY - py;

        // Clamp values within pad boundary
        touchX = Math.max(0, Math.min(width, touchX));
        touchY = Math.max(0, Math.min(height, touchY));

        // Map back to offsets [-100, 100]
        const nextColor = Math.round((touchX / width) * 200 - 100);
        const nextTone = Math.round((1.0 - touchY / height) * 200 - 100);

        onValuesChange(nextColor, nextTone);
      });
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onDragStart?.();
        handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderMove: (evt) => {
        handleTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      },
      onPanResponderRelease: () => {
        onDragEnd?.();
      },
      onPanResponderTerminate: () => {
        onDragEnd?.();
      },
    })
  ).current;

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setPadLayout({ width, height });
  };

  const handleX = padLayout.width * xPercent;
  const handleY = padLayout.height * yPercent;

  // Render a grid of subtle dots matching the design
  const gridDots = [];
  const rows = 9;
  const cols = 15;
  if (padLayout.width > 0 && padLayout.height > 0) {
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const dotX = (c / (cols - 1)) * padLayout.width;
        const dotY = (r / (rows - 1)) * padLayout.height;
        gridDots.push({ x: dotX, y: dotY });
      }
    }
  }

  return (
    <View
      ref={containerRef}
      onLayout={handleLayout}
      style={styles.padContainer}
      {...panResponder.panHandlers}
    >
      <Image
        source={require('../../assets/lut_customizer_gradient.png')}
        style={styles.backgroundImage}
        resizeMode="stretch"
      />

      {/* Grid of Dots */}
      {gridDots.map((dot, index) => (
        <View
          key={`dot-${index}`}
          style={[styles.gridDot, { left: dot.x - 1.5, top: dot.y - 1.5 }]}
        />
      ))}

      {/* Dotted Crosshairs (Horizontal & Vertical intersecting at the handle) */}
      {padLayout.width > 0 && (
        <>
          {/* Vertical Dotted Line */}
          <View
            style={[
              styles.dottedLineVertical,
              { left: handleX },
            ]}
          />
          {/* Horizontal Dotted Line */}
          <View
            style={[
              styles.dottedLineHorizontal,
              { top: handleY },
            ]}
          />
        </>
      )}

      {/* Draggable Handle */}
      {padLayout.width > 0 && (
        <View
          style={[
            styles.handle,
            {
              left: handleX - 14,
              top: handleY - 14,
            },
          ]}
        >
          <View style={styles.handleInnerDot} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  padContainer: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
  },
  backgroundImage: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    opacity: 0.9,
  },
  gridDot: {
    position: 'absolute',
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dottedLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderLeftWidth: 1.5,
    borderLeftColor: 'rgba(255,255,255,0.7)',
    borderStyle: 'dashed',
  },
  dottedLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.7)',
    borderStyle: 'dashed',
  },
  handle: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
  },
  handleInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
});
