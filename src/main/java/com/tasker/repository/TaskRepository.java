package com.tasker.repository;

import com.tasker.model.Task;
import com.tasker.model.TaskStatus;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface TaskRepository extends JpaRepository<Task, Long>, JpaSpecificationExecutor<Task> {

    @EntityGraph(attributePaths = {"assignee", "labels"})
    @Override
    List<Task> findAll(Specification<Task> spec, Sort sort);

    List<Task> findAllByStatusOrderByBoardOrderAsc(TaskStatus status);

    long countByStatus(TaskStatus status);
}
