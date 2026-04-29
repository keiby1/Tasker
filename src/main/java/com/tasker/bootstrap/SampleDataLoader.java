package com.tasker.bootstrap;

import com.tasker.dto.TaskRequest;
import com.tasker.model.Assignee;
import com.tasker.model.TaskStatus;
import com.tasker.repository.AssigneeRepository;
import com.tasker.repository.LabelRepository;
import com.tasker.repository.TaskRepository;
import com.tasker.service.LabelService;
import com.tasker.service.TaskService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class SampleDataLoader implements CommandLineRunner {

    private final AssigneeRepository assigneeRepository;
    private final LabelRepository labelRepository;
    private final LabelService labelService;
    private final TaskRepository taskRepository;
    private final TaskService taskService;

    @Override
    public void run(String... args) {
        if (taskRepository.count() > 0) {
            return;
        }
        assigneeRepository.saveAll(List.of(
                Assignee.builder().name("Александр").build(),
                Assignee.builder().name("Мария").build(),
                Assignee.builder().name("Иван").build()
        ));
        Assignee alex = assigneeRepository.findByNameIgnoreCase("Александр").orElseThrow();
        Assignee maria = assigneeRepository.findByNameIgnoreCase("Мария").orElseThrow();
        Assignee ivan = assigneeRepository.findByNameIgnoreCase("Иван").orElseThrow();
        log.info("Созданы демо-исполнители");

        var bug = labelService.create("C2C", "#ef4444");
        var feature = labelService.create("TM", "#22c55e");
        log.info("Созданы метки для демо");

        TaskRequest demo1 = build("Настройка Postgres", TaskStatus.TODO, alex.getId());
        demo1.setLabelIds(List.of(bug.getId()));
        demo1.setPlanStart(LocalDate.now().minusDays(2));
        demo1.setPlanEnd(LocalDate.now().plusDays(1));

        TaskRequest demo2 = build("Kanban UI", TaskStatus.IN_PROGRESS, maria.getId());
        demo2.setLabelIds(List.of(feature.getId()));
        demo2.setPlanStart(LocalDate.now());
        demo2.setPlanEnd(LocalDate.now().plusDays(5));

        TaskRequest demo3 = build("Diagram Gantt", TaskStatus.TODO, null);
        demo3.setLabelIds(List.of(feature.getId()));
        demo3.setPlanStart(LocalDate.now().plusDays(1));
        demo3.setPlanEnd(LocalDate.now().plusDays(8));

        TaskRequest demo4 = build("Обзор кода", TaskStatus.REVIEW, ivan.getId());
        demo4.setPlanStart(LocalDate.now().minusDays(1));
        demo4.setPlanEnd(LocalDate.now().plusDays(2));

        TaskRequest demo5 = build("Выкладка", TaskStatus.DONE, null);
        demo5.setPlanStart(LocalDate.now().minusDays(10));
        demo5.setPlanEnd(LocalDate.now().minusDays(3));

        taskService.create(demo1);
        taskService.create(demo2);
        taskService.create(demo3);
        taskService.create(demo4);
        taskService.create(demo5);
        log.info("Загружены демо-задачи");
    }

    private static TaskRequest build(String title, TaskStatus status, Long assigneeId) {
        TaskRequest r = new TaskRequest();
        r.setTitle(title);
        r.setDescription("Демонстрационная задача для Tasker.");
        r.setStatus(status);
        r.setAssigneeId(assigneeId);
        return r;
    }
}
