package com.tasker.spec;

import com.tasker.model.Label;
import com.tasker.model.Task;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;

import java.util.ArrayList;
import java.util.List;

public final class TaskSpecifications {

    private TaskSpecifications() {
    }

    public static Specification<Task> filtered(Long assigneeId, List<Long> labelIds) {
        return (root, query, cb) -> {
            query.distinct(true);
            List<Predicate> predicates = new ArrayList<>();
            if (assigneeId != null) {
                predicates.add(cb.equal(root.join("assignee", JoinType.INNER).get("id"), assigneeId));
            }
            if (labelIds != null && !labelIds.isEmpty()) {
                Join<Task, Label> labelJoin = root.join("labels", JoinType.INNER);
                predicates.add(labelJoin.get("id").in(labelIds));
            }
            if (predicates.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }
}
