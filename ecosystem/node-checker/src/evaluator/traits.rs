/// This trait defines the minimal set of functions that every evaluator
/// needs to implement.
pub trait Evaluator {
    /// This name is used when configuring which evaluators NHC will run.
    fn get_name(&self) -> String;
}

impl std::fmt::Debug for dyn Evaluator {
    fn fmt(&self, fmt: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        write!(fmt, "Evaluator {{ name: {:?} }}", self.get_name())
    }
}
