package com.tasker.dto;

import com.tasker.model.TaskKind;
import com.tasker.model.TaskStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
public class TaskRequest {

    @NotBlank
    @Size(max = 500)
    private String title;

    @Size(max = 4000)
    private String description;

    @Size(max = 2048)
    private String link;

    /** По умолчанию обычная задача (старые клиенты без поля). */
    private TaskKind kind = TaskKind.TASK;

    private LocalDate milestoneDate;

    @NotNull
    private TaskStatus status;

    private Long assigneeId;

    private LocalDate planStart;
    private LocalDate planEnd;

    private List<Long> labelIds;
}
