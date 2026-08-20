import { useEffect, useRef, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

interface AnimatedCounterProps {
  value: number;
  style?: TextStyle | TextStyle[];
  duration?: number;
}

/** Simple JS-driven count-up used for small dashboard-style stat numbers. */
export function AnimatedCounter({ value, style, duration = 650 }: AnimatedCounterProps) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    let frame: ReturnType<typeof requestAnimationFrame>;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - (1 - progress) * (1 - progress);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <Text style={style}>{display}</Text>;
}
