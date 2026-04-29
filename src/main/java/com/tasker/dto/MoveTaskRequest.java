package com.tasker.dto;

import com.tasker.model.TaskStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MoveTaskRequest {

    @NotNull
    private TaskStatus status;

    @NotNull
    private Integer boardOrder;
}
