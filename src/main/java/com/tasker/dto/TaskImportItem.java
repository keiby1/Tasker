package com.tasker.dto;

import com.tasker.model.TaskKind;
import com.tasker.model.TaskStatus;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

/** Элемент массива JSON для массового импорта: обновление по {@code id} или по непустому {@code link}, иначе создание. */
@Data
public class TaskImportItem {

    private Long id;

    private String title;

    private String description;

    private String link;

    private TaskKind kind;

    private LocalDate milestoneDate;

    private TaskStatus status;

    private Long assigneeId;

    private LocalDate planStart;

    private LocalDate planEnd;

    private List<Long> labelIds;
}
