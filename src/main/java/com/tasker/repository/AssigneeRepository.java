package com.tasker.repository;

import com.tasker.model.Assignee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AssigneeRepository extends JpaRepository<Assignee, Long> {

    Optional<Assignee> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
