export const formValue = (form: FormData, name: string) => String(form.get(name) ?? '').trim()
export const nullableValue = (form: FormData, name: string) => formValue(form, name) || null
