package com.tasker.model;

/** Имена совпадают с полем status на API; объединение в столбцы канбана — в {@code resources/static/js/app.js} ({@literal BOARD_LANES}). */
public enum TaskStatus {
    TODO,
    DEPLOY,
    PREPARE,
    IN_PROGRESS,
    REVIEW,
    DONE
}
