package com.tasker.web;

import com.tasker.dto.AssigneeDto;
import com.tasker.service.AssigneeService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/assignees")
@RequiredArgsConstructor
public class AssigneeController {

    private final AssigneeService assigneeService;

    @GetMapping
    public List<AssigneeDto> list() {
        return assigneeService.findAll();
    }

    @PostMapping
    public AssigneeDto create(@RequestBody Map<String, String> body) {
        return assigneeService.create(body != null ? body.get("name") : null);
    }
}
