import { Component, input } from "@angular/core";
import { AbstractControl, ValidationErrors } from "@angular/forms";
import { FormUtils } from "../../utils/form-utils";

@Component({
    selector: "app-form-error-label",
    imports: [],
    templateUrl: "./form-error-label.component.html",
})
export class FormErrorLabelComponent {
    control = input.required<AbstractControl>();
    requiredText = input<string | null>(null);

    get errorMessage(): string | null {
        const errors: ValidationErrors = this.control().errors || {};

        if (this.control().touched && errors["required"] && this.requiredText())
            return this.requiredText();
        return this.control().touched && Object.keys(errors).length > 0
            ? FormUtils.getTextError(errors)
            : null;
    }
}
