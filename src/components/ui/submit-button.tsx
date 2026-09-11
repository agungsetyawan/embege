"use client";

import { type ComponentProps, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./button";
import { Spinner } from "./spinner";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "asChild">;

export function SubmitButton({
  children,
  disabled,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <Button disabled={isDisabled} aria-busy={pending} {...props}>
      {children}
      {pending && <Spinner />}
    </Button>
  );
}

export function FormSubmitButton({
  children,
  disabled,
  formId,
  action,
  ...props
}: SubmitButtonProps & {
  formId: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [pending, startTransition] = useTransition();
  const isDisabled = disabled || pending;
  return (
    <Button
      {...props}
      type="button"
      disabled={isDisabled}
      aria-busy={pending}
      onClick={() => {
        const form = document.getElementById(formId);
        if (!(form instanceof HTMLFormElement)) return;
        if (!form.reportValidity()) return;
        startTransition(async () => {
          await action(new FormData(form));
        });
      }}
    >
      {children}
      {pending && <Spinner />}
    </Button>
  );
}
