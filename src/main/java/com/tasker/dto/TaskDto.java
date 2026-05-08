package com.tasker.dto;

import com.tasker.model.TaskKind;
import com.tasker.model.TaskStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class TaskDto {
    private Long id;
    private String title;
    private String description;
    private String link;
    private TaskKind kind;
    private LocalDate milestoneDate;
    private TaskStatus status;
    private AssigneeDto assignee;
    private LocalDate planStart;
    private LocalDate planEnd;
    private Integer boardOrder;
    private Instant createdAt;
    private Instant updatedAt;
    private List<LabelDto> labels;
}
