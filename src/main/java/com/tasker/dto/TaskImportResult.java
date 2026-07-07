package com.tasker.dto;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class TaskImportResult {
    private int created;
    private int updated;
    private List<String> errors;
}
