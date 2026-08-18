import { useState } from "react";
import { RETRO_COLOR_PALETTE } from "@independance/shared";
import styles from "./ColorPicker.module.css";

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  title?: string;
}

/**
 * A fixed 8-swatch retro-synthwave palette instead of a native
 * `<input type="color">` — see RETRO_COLOR_PALETTE for why this is a closed
 * set rather than an open picker.
 */
export function ColorPicker({ value, onChange, title = "Tile color" }: ColorPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.swatch}
        style={{ background: value }}
        onClick={() => setOpen((v) => !v)}
        aria-label={title}
        title={title}
      />
      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.grid} role="listbox" aria-label="Choose a color">
            {RETRO_COLOR_PALETTE.map((color) => (
              <button
                key={color}
                type="button"
                role="option"
                aria-selected={color === value}
                className={`${styles.option} ${color === value ? styles.selected : ""}`}
                style={{ background: color }}
                title={color}
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
