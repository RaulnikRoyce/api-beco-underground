-- Ownership: quem criou o evento pode excluí-lo (admin sempre pode)
ALTER TABLE eventos
    ADD COLUMN criado_por INT NULL AFTER local;

CREATE INDEX idx_eventos_criado_por ON eventos(criado_por);
