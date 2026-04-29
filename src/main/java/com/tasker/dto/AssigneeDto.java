package com.tasker.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AssigneeDto {
    private Long id;
    private String name;
}
