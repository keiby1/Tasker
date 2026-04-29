package com.tasker.service;

import com.tasker.dto.LabelDto;
import com.tasker.mapper.TaskMapper;
import com.tasker.model.Label;
import com.tasker.repository.LabelRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LabelService {

    private final LabelRepository labelRepository;

    @Transactional(readOnly = true)
    public List<LabelDto> findAll() {
        return labelRepository.findAll().stream()
                .map(TaskMapper::toLabelDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public LabelDto create(String name, String color) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("Название метки обязательно");
        }
        Label label = Label.builder()
                .name(name.trim())
                .color(color == null || color.isBlank() ? "#6b7280" : color.trim())
                .build();
        return TaskMapper.toLabelDto(labelRepository.save(label));
    }
}
