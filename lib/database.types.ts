export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      pacientes: {
        Row: {
          id: string;
          user_id: string | null;
          nombre: string;
          apellido: string;
          dni: string;
          fecha_nacimiento: string | null;
          sexo: string | null;
          direccion: string | null;
          telefono: string | null;
          email: string | null;
          obra_social: string | null;
          numero_afiliado: string | null;
          contacto_emergencia_nombre: string | null;
          contacto_emergencia_telefono: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          nombre: string;
          apellido: string;
          dni: string;
          fecha_nacimiento?: string | null;
          sexo?: string | null;
          direccion?: string | null;
          telefono?: string | null;
          email?: string | null;
          obra_social?: string | null;
          numero_afiliado?: string | null;
          contacto_emergencia_nombre?: string | null;
          contacto_emergencia_telefono?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          nombre?: string;
          apellido?: string;
          dni?: string;
          fecha_nacimiento?: string | null;
          sexo?: string | null;
          direccion?: string | null;
          telefono?: string | null;
          email?: string | null;
          obra_social?: string | null;
          numero_afiliado?: string | null;
          contacto_emergencia_nombre?: string | null;
          contacto_emergencia_telefono?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      doctors: {
        Row: {
          id: string;
          user_id: string;
          nombre: string | null;
          profesion: string | null;
          especialidad: string | null;
          telefono: string | null;
          documento: string | null;
          sexo: string | null;
          estado_civil: string | null;
          obra_social: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nombre?: string | null;
          profesion?: string | null;
          especialidad?: string | null;
          telefono?: string | null;
          documento?: string | null;
          sexo?: string | null;
          estado_civil?: string | null;
          obra_social?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nombre?: string | null;
          profesion?: string | null;
          especialidad?: string | null;
          telefono?: string | null;
          documento?: string | null;
          sexo?: string | null;
          estado_civil?: string | null;
          obra_social?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      antecedentes: {
        Row: {
          id: string;
          paciente_id: string;
          tipo: 'patologico_personal' | 'familiar' | 'alergia' | 'quirurgico' | 'habito';
          titulo: string;
          descripcion: string | null;
          fecha_registro: string;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          tipo: 'patologico_personal' | 'familiar' | 'alergia' | 'quirurgico' | 'habito';
          titulo: string;
          descripcion?: string | null;
          fecha_registro?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          tipo?: 'patologico_personal' | 'familiar' | 'alergia' | 'quirurgico' | 'habito';
          titulo?: string;
          descripcion?: string | null;
          fecha_registro?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      consultas: {
        Row: {
          id: string;
          paciente_id: string;
          profesional_id: string | null;
          fecha: string;
          motivo_consulta: string | null;
          examen_fisico: string | null;
          observaciones: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          profesional_id?: string | null;
          fecha: string;
          motivo_consulta?: string | null;
          examen_fisico?: string | null;
          observaciones?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          profesional_id?: string | null;
          fecha?: string;
          motivo_consulta?: string | null;
          examen_fisico?: string | null;
          observaciones?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      diagnosticos: {
        Row: {
          id: string;
          consulta_id: string;
          paciente_id: string;
          descripcion: string;
          codigo_cie10: string | null;
          fecha: string;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          consulta_id: string;
          paciente_id: string;
          descripcion: string;
          codigo_cie10?: string | null;
          fecha?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          consulta_id?: string;
          paciente_id?: string;
          descripcion?: string;
          codigo_cie10?: string | null;
          fecha?: string;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      medicaciones: {
        Row: {
          id: string;
          paciente_id: string;
          consulta_id: string | null;
          nombre_medicamento: string;
          dosis: string | null;
          frecuencia: string | null;
          fecha_inicio: string | null;
          fecha_fin: string | null;
          activa: boolean;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          consulta_id?: string | null;
          nombre_medicamento: string;
          dosis?: string | null;
          frecuencia?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          activa?: boolean;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          consulta_id?: string | null;
          nombre_medicamento?: string;
          dosis?: string | null;
          frecuencia?: string | null;
          fecha_inicio?: string | null;
          fecha_fin?: string | null;
          activa?: boolean;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      recetas: {
        Row: {
          id: string;
          paciente_id: string;
          consulta_id: string | null;
          fecha_emision: string;
          pdf_url: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paciente_id: string;
          consulta_id?: string | null;
          fecha_emision?: string;
          pdf_url?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paciente_id?: string;
          consulta_id?: string | null;
          fecha_emision?: string;
          pdf_url?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      receta_medicaciones: {
        Row: {
          id: string;
          receta_id: string;
          nombre_medicamento: string;
          dosis: string | null;
          frecuencia: string | null;
          instrucciones: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          receta_id: string;
          nombre_medicamento: string;
          dosis?: string | null;
          frecuencia?: string | null;
          instrucciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          receta_id?: string;
          nombre_medicamento?: string;
          dosis?: string | null;
          frecuencia?: string | null;
          instrucciones?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      turnos: {
        Row: {
          id: string;
          nombre: string;
          email: string;
          telefono: string;
          motivo: string;
          fecha_preferida: string;
          hora_preferida: string;
          estado: string;
          recordatorio_enviado: boolean;
          obra_social: string | null;
          es_particular: boolean;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          email: string;
          telefono: string;
          motivo: string;
          fecha_preferida: string;
          hora_preferida: string;
          estado?: string;
          recordatorio_enviado?: boolean;
          obra_social?: string | null;
          es_particular?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          nombre?: string;
          email?: string;
          telefono?: string;
          motivo?: string;
          fecha_preferida?: string;
          hora_preferida?: string;
          estado?: string;
          recordatorio_enviado?: boolean;
          obra_social?: string | null;
          es_particular?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
      };
      estudios: {
        Row: {
          id: string;
          paciente_email: string;
          titulo: string;
          categoria: string;
          fecha: string;
          hora: string;
          file_url: string | null;
          external_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          paciente_email: string;
          titulo: string;
          categoria: string;
          fecha: string;
          hora: string;
          file_url?: string | null;
          external_url?: string | null;
          created_at?: string;
        };
        Update: {
          paciente_email?: string;
          titulo?: string;
          categoria?: string;
          fecha?: string;
          hora?: string;
          file_url?: string | null;
          external_url?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
}
