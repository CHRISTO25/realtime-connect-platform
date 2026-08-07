package errors

import (
	"fmt"
	"net/http"
)

type AppError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	StatusCode int    `json:"-"`
}

func (e *AppError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func NewAppError(code, message string, statusCode int) *AppError {
	return &AppError{
		Code:       code,
		Message:    message,
		StatusCode: statusCode,
	}
}

// Common Standard Error Helpers
func BadRequest(message string) *AppError {
	return NewAppError("BAD_REQUEST", message, http.StatusBadRequest)
}

func Unauthorized(message string) *AppError {
	return NewAppError("UNAUTHORIZED", message, http.StatusUnauthorized)
}

func Forbidden(message string) *AppError {
	return NewAppError("FORBIDDEN", message, http.StatusForbidden)
}

func NotFound(message string) *AppError {
	return NewAppError("NOT_FOUND", message, http.StatusNotFound)
}

func Conflict(message string) *AppError {
	return NewAppError("CONFLICT", message, http.StatusConflict)
}

func Internal(message string) *AppError {
	return NewAppError("INTERNAL_SERVER_ERROR", message, http.StatusInternalServerError)
}
