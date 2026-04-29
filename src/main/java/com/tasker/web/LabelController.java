package com.tasker.web;

import com.tasker.dto.LabelDto;
import com.tasker.service.LabelService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/labels")
@RequiredArgsConstructor
public class LabelController {

    private final LabelService labelService;

    @GetMapping
    public List<LabelDto> list() {
        return labelService.findAll();
    }

    @PostMapping
    public LabelDto create(@RequestBody Map<String, String> body) {
        return labelService.create(body.get("name"), body.get("color"));
    }
}
