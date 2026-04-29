package com.tasker.config;

import org.hibernate.cfg.AvailableSettings;
import org.hibernate.dialect.PostgreSQLDialect;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Явная привязка диалекта к Hibernate на случай, если авто-поиск по JDBC-метаданным недоступен
 * при старте (нет соединения, порядок инициализации и т.п.).
 */
@Configuration
public class JpaDialectConfig {

    @Bean
    public HibernatePropertiesCustomizer postgresDialect() {
        return props -> props.put(AvailableSettings.DIALECT, PostgreSQLDialect.class.getCanonicalName());
    }
}
