package com.tasker.service;

import com.tasker.dto.MoveTaskRequest;
import com.tasker.dto.TaskDto;
import com.tasker.dto.TaskRequest;
import com.tasker.mapper.TaskMapper;
import com.tasker.model.Label;
import com.tasker.model.Task;
import com.tasker.model.TaskStatus;
import com.tasker.model.Assignee;
import com.tasker.repository.AssigneeRepository;
import com.tasker.repository.LabelRepository;
import com.tasker.repository.TaskRepository;
import com.tasker.spec.TaskSpecifications;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;
    private final LabelRepository labelRepository;
    private final AssigneeRepository assigneeRepository;

    @Transactional(readOnly = true)
    public List<TaskDto> findAll(Long assigneeId, List<Long> labelIds) {
        Specification<Task> spec = TaskSpecifications.filtered(assigneeId, labelIds);
        Sort sort = Sort.by("status").ascending()
                .and(Sort.by("boardOrder").ascending());

        return taskRepository.findAll(spec, sort).stream()
                .map(TaskMapper::toDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public TaskDto getById(Long id) {
        return taskRepository.findById(id)
                .map(TaskMapper::toDto)
                .orElseThrow(() -> new NotFoundException("Задача не найдена: " + id));
    }

    @Transactional
    public TaskDto create(TaskRequest req) {
        Instant now = Instant.now();
        Task task = Task.builder()
                .title(req.getTitle())
                .description(req.getDescription())
                .status(req.getStatus())
                .assignee(resolveAssignee(req.getAssigneeId()))
                .planStart(req.getPlanStart())
                .planEnd(req.getPlanEnd())
                .boardOrder(0)
                .createdAt(now)
                .updatedAt(now)
                .labels(resolveLabels(req.getLabelIds()))
                .build();

        taskRepository.saveAndFlush(task);
        appendTaskToColumnEnd(taskRepository.findById(task.getId()).orElse(task), now);
        return TaskMapper.toDto(taskRepository.findById(task.getId()).orElseThrow());
    }

    @Transactional
    public TaskDto update(Long id, TaskRequest req) {
        Instant now = Instant.now();
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Задача не найдена: " + id));

        TaskStatus oldStatus = task.getStatus();

        task.setTitle(req.getTitle());
        task.setDescription(req.getDescription());
        task.setAssignee(resolveAssignee(req.getAssigneeId()));
        task.setPlanStart(req.getPlanStart());
        task.setPlanEnd(req.getPlanEnd());

        task.getLabels().clear();
        task.getLabels().addAll(resolveLabels(req.getLabelIds()));

        if (oldStatus != req.getStatus()) {
            removeTaskFromColumn(task.getId(), oldStatus, now);
            task.setStatus(req.getStatus());
            taskRepository.flush();
            appendTaskToColumnEnd(task, now);
        }

        task.setUpdatedAt(now);
        return TaskMapper.toDto(taskRepository.save(task));
    }

    @Transactional
    public TaskDto move(Long id, MoveTaskRequest req) {
        Instant now = Instant.now();
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Задача не найдена: " + id));

        TaskStatus from = task.getStatus();
        TaskStatus to = req.getStatus();
        int insertIndex = req.getBoardOrder();

        if (from == to) {
            List<Task> col = mutableColumn(from);
            col.removeIf(t -> t.getId().equals(id));
            int clamped = Math.min(Math.max(0, insertIndex), col.size());
            col.add(clamped, task);
            resequence(col, now);
        } else {
            removeTaskFromColumn(id, from, now);
            task.setStatus(to);
            taskRepository.flush();

            List<Task> colTo = mutableColumn(to);
            colTo.removeIf(t -> t.getId().equals(id));
            int clamped = Math.min(Math.max(0, insertIndex), colTo.size());
            colTo.add(clamped, task);
            resequence(colTo, now);
        }

        task.setUpdatedAt(now);
        taskRepository.save(task);
        return TaskMapper.toDto(taskRepository.findById(id).orElseThrow());
    }

    @Transactional
    public void delete(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Задача не найдена: " + id));
        TaskStatus st = task.getStatus();
        taskRepository.delete(task);
        taskRepository.flush();

        List<Task> col = mutableColumn(st);
        col.removeIf(t -> t.getId().equals(id));
        resequence(col, Instant.now());
    }

    private void appendTaskToColumnEnd(Task task, Instant now) {
        List<Task> col = mutableColumn(task.getStatus());
        col.removeIf(t -> t.getId().equals(task.getId()));
        col.add(task);
        resequence(col, now);
    }

    private void removeTaskFromColumn(Long taskId, TaskStatus status, Instant now) {
        List<Task> col = mutableColumn(status);
        col.removeIf(t -> t.getId().equals(taskId));
        resequence(col, now);
    }

    private List<Task> mutableColumn(TaskStatus status) {
        return new ArrayList<>(taskRepository.findAllByStatusOrderByBoardOrderAsc(status));
    }

    private void resequence(List<Task> columnTasks, Instant now) {
        for (int i = 0; i < columnTasks.size(); i++) {
            Task t = columnTasks.get(i);
            Task managed = taskRepository.findById(t.getId()).orElse(t);
            managed.setBoardOrder(i);
            managed.setUpdatedAt(now);
            taskRepository.save(managed);
        }
    }

    private Set<Label> resolveLabels(List<Long> labelIds) {
        if (labelIds == null || labelIds.isEmpty()) {
            return new HashSet<>();
        }
        return new HashSet<>(labelRepository.findByIdIn(labelIds));
    }

    private Assignee resolveAssignee(Long id) {
        if (id == null) {
            return null;
        }
        return assigneeRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Исполнитель не найден: " + id));
    }
}
