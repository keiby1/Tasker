package com.tasker.mapper;

import com.tasker.dto.AssigneeDto;
import com.tasker.dto.LabelDto;
import com.tasker.dto.TaskDto;
import com.tasker.model.Assignee;
import com.tasker.model.Label;
import com.tasker.model.Task;
import com.tasker.model.TaskKind;

import java.util.Comparator;
import java.util.Optional;
import java.util.stream.Collectors;

public final class TaskMapper {

    private TaskMapper() {
    }

    public static AssigneeDto toAssigneeDto(Assignee assignee) {
        if (assignee == null) {
            return null;
        }
        return AssigneeDto.builder()
                .id(assignee.getId())
                .name(assignee.getName())
                .build();
    }

    public static LabelDto toLabelDto(Label label) {
        if (label == null) {
            return null;
        }
        return LabelDto.builder()
                .id(label.getId())
                .name(label.getName())
                .color(label.getColor())
                .build();
    }

    public static TaskDto toDto(Task task) {
        var labels = task.getLabels().stream()
                .map(TaskMapper::toLabelDto)
                .sorted(Comparator.comparing(l -> Optional.ofNullable(l.getName()).orElse(""), String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());

        return TaskDto.builder()
                .id(task.getId())
                .title(task.getTitle())
                .description(task.getDescription())
                .link(task.getLink())
                .kind(task.getKind())
                .milestoneDate(task.getMilestoneDate())
                .status(task.getStatus())
                .assignee(toAssigneeDto(task.getAssignee()))
                .planStart(task.getPlanStart())
                .planEnd(task.getPlanEnd())
                .boardOrder(task.getBoardOrder())
                .createdAt(task.getCreatedAt())
                .updatedAt(task.getUpdatedAt())
                .labels(labels)
                .build();
    }
}
