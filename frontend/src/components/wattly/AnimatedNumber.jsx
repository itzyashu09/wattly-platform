import { useEffect, useRef, useState } from "react";
import { motion, useSpring, useTransform } from "framer-motion";

export default function AnimatedNumber({ value, decimals = 0, prefix = "", suffix = "", className = "", testId }) {
  const spring = useSpring(0, { stiffness: 80, damping: 22 });
  const display = useTransform(spring, (latest) =>
    `${prefix}${Number(latest).toLocaleString("en-IN", { maximumFractionDigits: decimals, minimumFractionDigits: decimals })}${suffix}`
  );

  useEffect(() => {
    spring.set(value || 0);
  }, [value, spring]);

  return (
    <motion.span className={className} data-testid={testId}>
      {display}
    </motion.span>
  );
}
