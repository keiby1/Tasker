package com.tasker.web;

import com.tasker.dto.MoveTaskRequest;
import com.tasker.dto.TaskDto;
import com.tasker.dto.TaskRequest;
import com.tasker.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;

    @GetMapping
    public List<TaskDto> list(
            @RequestParam(required = false) Long assigneeId,
            @RequestParam(required = false) Long labelId,
            @RequestParam(required = false) List<Long> labelIds
    ) {
        return taskService.findAll(assigneeId, normalizeLabelIds(labelId, labelIds));
    }

    private static List<Long> normalizeLabelIds(Long labelId, List<Long> labelIds) {
        Set<Long> out = new LinkedHashSet<>();
        if (labelIds != null) {
            for (Long id : labelIds) {
                if (id != null) {
                    out.add(id);
                }
            }
        }
        if (out.isEmpty() && labelId != null) {
            out.add(labelId);
        }
        return new ArrayList<>(out);
    }

    @GetMapping("/{id}")
    public TaskDto one(@PathVariable Long id) {
        return taskService.getById(id);
    }

    @PostMapping
    public TaskDto create(@Valid @RequestBody TaskRequest req) {
        return taskService.create(req);
    }

    @PutMapping("/{id}")
    public TaskDto update(@PathVariable Long id, @Valid @RequestBody TaskRequest req) {
        return taskService.update(id, req);
    }

    @PutMapping("/{id}/move")
    public TaskDto move(@PathVariable Long id, @Valid @RequestBody MoveTaskRequest req) {
        return taskService.move(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        taskService.delete(id);
    }
}
