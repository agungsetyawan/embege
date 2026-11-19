"use client";

import { type ComponentProps, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "./button";
import { Spinner } from "./spinner";

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "asChild">;

// Admin server actions return an error message (string) when they fail.
type FormAction = (formData: FormData) => unknown;

function toastIfError(result: unknown) {
  if (typeof result === "string") toast.error(result);
}

// <form action> for a server action that returns an error message: React
// types a form action as returning void, and the message becomes a toast.
// Usable from Server Components, which cannot pass onSubmit handlers.
export function ActionForm({
  action,
  ...props
}: Omit<ComponentProps<"form">, "action"> & { action: FormAction }) {
  return (
    <form
      {...props}
      action={async (formData) => toastIfError(await action(formData))}
    />
  );
}

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
  action: FormAction;
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
          toastIfError(await action(new FormData(form)));
        });
      }}
    >
      {children}
      {pending && <Spinner />}
    </Button>
  );
}
