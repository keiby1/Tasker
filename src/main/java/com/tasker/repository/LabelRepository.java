package com.tasker.repository;

import com.tasker.model.Label;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface LabelRepository extends JpaRepository<Label, Long> {

    List<Label> findByIdIn(Collection<Long> ids);
}
