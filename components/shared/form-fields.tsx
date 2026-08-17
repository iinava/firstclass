"use client"

import * as React from "react"
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from "react-hook-form"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OptionSelect, type SelectOption } from "@/components/shared/option-select"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

/**
 * Thin wrappers over Controller + Field.
 *
 * Every module's forms share the same wiring — label, control, invalid state,
 * error message — so it lives here once instead of being re-typed per form.
 * Values are coerced to "" because RHF fields must stay controlled.
 */

interface BaseFieldProps<T extends FieldValues> {
  control: Control<T>
  name: FieldPath<T>
  label: string
  description?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  autoFocus?: boolean
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  disabled,
  className,
  autoFocus,
  type = "text",
  inputMode,
}: BaseFieldProps<T> & {
  type?: string
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email"
}) {
  const id = `field-${name}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field
          data-invalid={fieldState.invalid}
          data-disabled={disabled}
          className={className}
        >
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <Input
            {...field}
            value={field.value == null ? "" : String(field.value)}
            id={id}
            type={type}
            inputMode={inputMode}
            placeholder={placeholder}
            disabled={disabled}
            autoFocus={autoFocus}
            aria-invalid={fieldState.invalid}
          />
          {description && !fieldState.error && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

/** Money is entered in rupees; the zod schema converts to paise on submit. */
export function MoneyField<T extends FieldValues>(props: BaseFieldProps<T>) {
  return (
    <TextField
      {...props}
      type="text"
      inputMode="decimal"
      placeholder={props.placeholder ?? "0.00"}
    />
  )
}

export function NumberField<T extends FieldValues>({
  min,
  max,
  ...props
}: BaseFieldProps<T> & { min?: number; max?: number }) {
  const id = `field-${props.name}`
  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={props.className}>
          <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
          <Input
            {...field}
            value={field.value == null ? "" : String(field.value)}
            id={id}
            type="number"
            min={min}
            max={max}
            disabled={props.disabled}
            placeholder={props.placeholder}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export function DateField<T extends FieldValues>(props: BaseFieldProps<T>) {
  return <TextField {...props} type="date" />
}

export function DateTimeField<T extends FieldValues>(props: BaseFieldProps<T>) {
  return <TextField {...props} type="datetime-local" />
}

export type { SelectOption }

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  options,
  placeholder,
  disabled,
  className,
  /** Emits null instead of "" so optional FKs store NULL. */
  nullable = false,
}: BaseFieldProps<T> & { options: SelectOption[]; nullable?: boolean }) {
  const id = `field-${name}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={className}>
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <OptionSelect
            id={id}
            name={field.name}
            className="w-full"
            // The placeholder stays a selectable row so a nullable field can be
            // cleared again after a value has been picked.
            options={
              placeholder
                ? [{ value: "", label: placeholder }, ...options]
                : options
            }
            value={field.value == null ? "" : String(field.value)}
            onValueChange={(value) =>
              field.onChange(nullable && value === "" ? null : value)
            }
            onBlur={field.onBlur}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          />
          {description && !fieldState.error && (
            <FieldDescription>{description}</FieldDescription>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export function TextareaField<T extends FieldValues>({
  rows = 3,
  ...props
}: BaseFieldProps<T> & { rows?: number }) {
  const id = `field-${props.name}`
  return (
    <Controller
      control={props.control}
      name={props.name}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid} className={props.className}>
          <FieldLabel htmlFor={id}>{props.label}</FieldLabel>
          <Textarea
            {...field}
            value={field.value == null ? "" : String(field.value)}
            id={id}
            rows={rows}
            placeholder={props.placeholder}
            disabled={props.disabled}
            aria-invalid={fieldState.invalid}
          />
          {props.description && !fieldState.error && (
            <FieldDescription>{props.description}</FieldDescription>
          )}
          {fieldState.error && <FieldError errors={[fieldState.error]} />}
        </Field>
      )}
    />
  )
}

export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
}: BaseFieldProps<T>) {
  const id = `field-${name}`
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Field
          orientation="horizontal"
          className={cn("justify-between", className)}
        >
          <div className="flex flex-col gap-0.5">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description && <FieldDescription>{description}</FieldDescription>}
          </div>
          <Switch
            id={id}
            checked={Boolean(field.value)}
            onCheckedChange={field.onChange}
          />
        </Field>
      )}
    />
  )
}

export { optionsFrom } from "@/components/shared/option-select"
