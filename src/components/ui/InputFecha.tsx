"use client";

import { useRef, type ChangeEvent, type KeyboardEvent } from "react";

export interface InputFechaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

export function InputFecha({
  value,
  onChange,
  placeholder = "DD/MM/YYYY",
  className,
  disabled,
  id,
  name,
}: InputFechaProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function aplicarMascara(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let result = "";
    for (let i = 0; i < digits.length; i++) {
      if (i === 2 || i === 4) result += "/";
      result += digits[i]!;
    }
    return result;
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = aplicarMascara(e.target.value);
    onChange(masked);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && value.endsWith("/")) {
      e.preventDefault();
      onChange(value.slice(0, -2));
    }
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      id={id}
      name={name}
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      maxLength={10}
      disabled={disabled}
      className={className}
      autoComplete="off"
    />
  );
}
