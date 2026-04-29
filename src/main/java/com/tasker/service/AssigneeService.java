package com.tasker.service;

import com.tasker.dto.AssigneeDto;
import com.tasker.model.Assignee;
import com.tasker.repository.AssigneeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssigneeService {

    private final AssigneeRepository assigneeRepository;

    @Transactional(readOnly = true)
    public List<AssigneeDto> findAll() {
        return assigneeRepository.findAll().stream()
                .map(a -> AssigneeDto.builder().id(a.getId()).name(a.getName()).build())
                .sorted(Comparator.comparing(AssigneeDto::getName, String.CASE_INSENSITIVE_ORDER))
                .collect(Collectors.toList());
    }

    @Transactional
    public AssigneeDto create(String name) {
        String trimmed = name == null ? "" : name.trim();
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("Имя исполнителя обязательно");
        }
        if (assigneeRepository.existsByNameIgnoreCase(trimmed)) {
            throw new IllegalArgumentException("Такой исполнитель уже есть");
        }
        Assignee a = Assignee.builder().name(trimmed).build();
        Assignee saved = assigneeRepository.save(a);
        return AssigneeDto.builder().id(saved.getId()).name(saved.getName()).build();
    }
}
