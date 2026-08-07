package validator

import (
	"fmt"
	"strings"

	"github.com/go-playground/validator/v10"
)

// FormatValidationError converts raw Struct Validation errors into a readable map
func FormatValidationError(err error) map[string]string {
	fieldErrors := make(map[string]string)

	validationErrs, ok := err.(validator.ValidationErrors)
	if !ok {
		fieldErrors["payload"] = "Invalid request JSON format"
		return fieldErrors
	}

	for _, fieldErr := range validationErrs {
		field := toSnakeCase(fieldErr.Field())
		switch fieldErr.Tag() {
		case "required":
			fieldErrors[field] = fmt.Sprintf("%s is required", field)
		case "email":
			fieldErrors[field] = "Invalid email format"
		case "min":
			fieldErrors[field] = fmt.Sprintf("%s must be at least %s characters", field, fieldErr.Param())
		case "max":
			fieldErrors[field] = fmt.Sprintf("%s cannot exceed %s characters", field, fieldErr.Param())
		case "uuid":
			fieldErrors[field] = fmt.Sprintf("%s must be a valid UUID", field)
		default:
			fieldErrors[field] = fmt.Sprintf("%s is invalid", field)
		}
	}

	return fieldErrors
}

func toSnakeCase(str string) string {
	var result []rune
	for i, r := range str {
		if i > 0 && r >= 'A' && r <= 'Z' {
			result = append(result, '_')
		}
		result = append(result, r)
	}
	return strings.ToLower(string(result))
}
